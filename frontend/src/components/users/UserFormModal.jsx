import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';

import Modal from '../common/Modal';
import LoadingSpinner from '../common/LoadingSpinner';
import userService from '../../services/userService';
import { ROLE_LABELS } from '../../utils/userMeta';

/**
 * Create / edit user dialog.
 *
 * Validation mirrors the backend (username pattern, email, password strength,
 * role, optional department) so the user gets fast feedback; the server remains
 * the source of truth and its per-field `details` are mapped back onto the form.
 */
const ROLES = ['admin', 'registrar', 'department_head', 'instructor', 'student'];

const passwordField = z
  .string()
  .min(8, 'At least 8 characters')
  .max(128, 'Too long')
  .regex(/[A-Za-z]/, 'Include at least one letter')
  .regex(/[0-9]/, 'Include at least one number');

const sharedFields = {
  fullName: z.string().trim().min(2, 'Enter a full name').max(100, 'Too long'),
  username: z
    .string()
    .trim()
    .regex(/^[a-zA-Z0-9._-]{3,50}$/, '3–50 chars: letters, numbers, . _ -'),
  email: z.string().trim().email('Enter a valid email address').max(100, 'Too long'),
  role: z.enum(ROLES, { errorMap: () => ({ message: 'Select a role' }) }),
  departmentId: z.string().optional(),
  phone: z.string().trim().max(20, 'Too long').optional(),
  isActive: z.boolean(),
  isVerified: z.boolean(),
};

function buildSchema(mode) {
  return z.object(mode === 'create' ? { ...sharedFields, password: passwordField } : sharedFields);
}

const SERVER_FIELDS = [
  'fullName',
  'username',
  'email',
  'role',
  'departmentId',
  'phone',
  'password',
  'isActive',
  'isVerified',
];

export default function UserFormModal({ mode, user, options, onClose, onSaved }) {
  const [serverError, setServerError] = useState(null);
  const departments = options?.departments || [];

  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm({
    resolver: zodResolver(buildSchema(mode)),
    defaultValues:
      mode === 'create'
        ? {
            fullName: '',
            username: '',
            email: '',
            role: 'student',
            departmentId: '',
            phone: '',
            password: '',
            isActive: true,
            isVerified: true,
          }
        : {
            fullName: user.fullName || '',
            username: user.username || '',
            email: user.email || '',
            role: user.role,
            departmentId: user.department ? String(user.department.id) : '',
            phone: user.phone || '',
            isActive: Boolean(user.isActive),
            isVerified: Boolean(user.isVerified),
          },
  });

  const onSubmit = async (values) => {
    setServerError(null);

    const payload = {
      fullName: values.fullName,
      username: values.username,
      email: values.email,
      role: values.role,
      departmentId: values.departmentId === '' || values.departmentId === undefined ? null : Number(values.departmentId),
      phone: values.phone ? values.phone : null,
      isActive: values.isActive,
      isVerified: values.isVerified,
    };
    if (mode === 'create') payload.password = values.password;

    try {
      if (mode === 'create') {
        const response = await userService.create(payload);
        onSaved(`User “${response.data.user.username}” created.`);
      } else {
        const response = await userService.update(user.id, payload);
        onSaved(`User “${response.data.user.username}” updated.`);
      }
    } catch (error) {
      let mapped = 0;
      const details = Array.isArray(error.details) ? error.details : [];
      details.forEach((detail) => {
        if (SERVER_FIELDS.includes(detail.field)) {
          setError(detail.field, { type: 'server', message: detail.message });
          mapped += 1;
        }
      });
      if (mapped === 0) {
        setServerError(error.message || 'Could not save the user.');
      }
    }
  };

  const busy = isSubmitting;

  return (
    <Modal
      title={mode === 'create' ? 'New user' : 'Edit user'}
      subtitle={mode === 'create' ? 'Create an account and assign a role.' : `@${user.username}`}
      onClose={busy ? () => {} : onClose}
      footer={
        <>
          <button type="button" className="btn btn-ghost" onClick={onClose} disabled={busy}>
            Cancel
          </button>
          <button type="submit" form="user-form" className="btn btn-primary" disabled={busy}>
            {busy ? <LoadingSpinner inline /> : null}
            {mode === 'create' ? 'Create user' : 'Save changes'}
          </button>
        </>
      }
    >
      <form id="user-form" className="stack gap-4" onSubmit={handleSubmit(onSubmit)} noValidate>
        {serverError ? (
          <div className="notice notice-danger" role="alert">
            {serverError}
          </div>
        ) : null}

        <div className="form-grid">
          <div className="field field-full">
            <label className="field-label" htmlFor="user-fullname">
              Full name
            </label>
            <input
              id="user-fullname"
              className="input"
              type="text"
              autoComplete="name"
              aria-invalid={errors.fullName ? 'true' : 'false'}
              {...register('fullName')}
            />
            {errors.fullName ? <span className="field-error">{errors.fullName.message}</span> : null}
          </div>

          <div className="field">
            <label className="field-label" htmlFor="user-username">
              Username
            </label>
            <input
              id="user-username"
              className="input"
              type="text"
              autoComplete="off"
              aria-invalid={errors.username ? 'true' : 'false'}
              {...register('username')}
            />
            {errors.username ? <span className="field-error">{errors.username.message}</span> : null}
          </div>

          <div className="field">
            <label className="field-label" htmlFor="user-email">
              Email
            </label>
            <input
              id="user-email"
              className="input"
              type="email"
              autoComplete="off"
              aria-invalid={errors.email ? 'true' : 'false'}
              {...register('email')}
            />
            {errors.email ? <span className="field-error">{errors.email.message}</span> : null}
          </div>

          <div className="field">
            <label className="field-label" htmlFor="user-role">
              Role
            </label>
            <select
              id="user-role"
              className="input"
              aria-invalid={errors.role ? 'true' : 'false'}
              {...register('role')}
            >
              {ROLES.map((role) => (
                <option key={role} value={role}>
                  {ROLE_LABELS[role] || role}
                </option>
              ))}
            </select>
            {errors.role ? <span className="field-error">{errors.role.message}</span> : null}
          </div>

          <div className="field">
            <label className="field-label" htmlFor="user-department">
              Department
            </label>
            <select id="user-department" className="input" {...register('departmentId')}>
              <option value="">No department</option>
              {departments.map((department) => (
                <option key={department.id} value={department.id}>
                  {department.name} ({department.code})
                </option>
              ))}
            </select>
            {errors.departmentId ? <span className="field-error">{errors.departmentId.message}</span> : null}
          </div>

          <div className="field">
            <label className="field-label" htmlFor="user-phone">
              Phone
            </label>
            <input id="user-phone" className="input" type="tel" autoComplete="off" {...register('phone')} />
            {errors.phone ? <span className="field-error">{errors.phone.message}</span> : null}
          </div>

          {mode === 'create' ? (
            <div className="field">
              <label className="field-label" htmlFor="user-password">
                Password
              </label>
              <input
                id="user-password"
                className="input"
                type="password"
                autoComplete="new-password"
                aria-invalid={errors.password ? 'true' : 'false'}
                {...register('password')}
              />
              {errors.password ? (
                <span className="field-error">{errors.password.message}</span>
              ) : (
                <span className="field-hint">Min 8 chars, with a letter and a number.</span>
              )}
            </div>
          ) : null}

          <div className="field field-full stack gap-2">
            <label className="checkbox-field" htmlFor="user-active">
              <input id="user-active" type="checkbox" {...register('isActive')} />
              <span>Account is active (can sign in)</span>
            </label>
            <label className="checkbox-field" htmlFor="user-verified">
              <input id="user-verified" type="checkbox" {...register('isVerified')} />
              <span>Email is verified</span>
            </label>
          </div>
        </div>
      </form>
    </Modal>
  );
}
