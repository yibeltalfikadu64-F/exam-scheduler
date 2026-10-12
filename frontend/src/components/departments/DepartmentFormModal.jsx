import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';

import Modal from '../common/Modal';
import LoadingSpinner from '../common/LoadingSpinner';
import departmentService from '../../services/departmentService';

const SERVER_FIELDS = ['code', 'name', 'description', 'headId', 'isActive'];

const schema = z.object({
  code: z
    .string()
    .trim()
    .min(2, 'Code must be 2-20 characters')
    .max(20, 'Code must be 2-20 characters')
    .regex(/^[A-Za-z0-9._-]+$/, 'Use letters, numbers, dot, underscore, or hyphen'),
  name: z.string().trim().min(2, 'Name must be 2-150 characters').max(150, 'Name must be 2-150 characters'),
  description: z.string().trim().max(2000, 'Description too long').optional().or(z.literal('')),
  headId: z.string().optional().or(z.literal('')),
  isActive: z.boolean(),
});

export default function DepartmentFormModal({ mode, department, heads = [], onClose, onSaved }) {
  const [serverError, setServerError] = useState(null);

  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm({
    resolver: zodResolver(schema),
    defaultValues:
      mode === 'create'
        ? {
            code: '',
            name: '',
            description: '',
            headId: '',
            isActive: true,
          }
        : {
            code: department.code || '',
            name: department.name || '',
            description: department.description || '',
            headId: department.head ? String(department.head.id) : '',
            isActive: Boolean(department.isActive),
          },
  });

  const onSubmit = async (values) => {
    setServerError(null);

    const payload = {
      code: values.code.trim().toUpperCase(),
      name: values.name.trim(),
      description: values.description ? values.description.trim() : null,
      headId: values.headId === '' || values.headId === undefined ? null : Number(values.headId),
      isActive: values.isActive,
    };

    try {
      if (mode === 'create') {
        const response = await departmentService.create(payload);
        onSaved(`Department "${response.data.department.code}" created.`);
      } else {
        const response = await departmentService.update(department.id, payload);
        onSaved(`Department "${response.data.department.code}" updated.`);
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
        setServerError(error.message || 'Could not save department.');
      }
    }
  };

  const busy = isSubmitting;

  return (
    <Modal
      title={mode === 'create' ? 'New department' : 'Edit department'}
      subtitle={mode === 'create' ? 'Add an academic department.' : `${department.code} — ${department.name}`}
      onClose={busy ? () => {} : onClose}
      footer={
        <>
          <button type="button" className="btn btn-ghost" onClick={onClose} disabled={busy}>
            Cancel
          </button>
          <button type="submit" form="dept-form" className="btn btn-primary" disabled={busy}>
            {busy ? <LoadingSpinner inline /> : null}
            {mode === 'create' ? 'Create department' : 'Save changes'}
          </button>
        </>
      }
    >
      <form id="dept-form" className="stack gap-4" onSubmit={handleSubmit(onSubmit)} noValidate>
        {serverError ? (
          <div className="notice notice-danger" role="alert">
            {serverError}
          </div>
        ) : null}

        <div className="form-grid">
          <div className="field">
            <label className="field-label" htmlFor="dept-code">
              Code
            </label>
            <input
              id="dept-code"
              className="input"
              type="text"
              autoComplete="off"
              aria-invalid={errors.code ? 'true' : 'false'}
              {...register('code')}
            />
            {errors.code ? <span className="field-error">{errors.code.message}</span> : null}
          </div>

          <div className="field">
            <label className="field-label" htmlFor="dept-name">
              Name
            </label>
            <input
              id="dept-name"
              className="input"
              type="text"
              autoComplete="off"
              aria-invalid={errors.name ? 'true' : 'false'}
              {...register('name')}
            />
            {errors.name ? <span className="field-error">{errors.name.message}</span> : null}
          </div>

          <div className="field field-full">
            <label className="field-label" htmlFor="dept-description">
              Description
            </label>
            <textarea
              id="dept-description"
              className="input"
              rows={3}
              aria-invalid={errors.description ? 'true' : 'false'}
              {...register('description')}
            />
            {errors.description ? <span className="field-error">{errors.description.message}</span> : null}
          </div>

          <div className="field">
            <label className="field-label" htmlFor="dept-head">
              Department head
            </label>
            <select id="dept-head" className="input" {...register('headId')}>
              <option value="">No head assigned</option>
              {heads.map((head) => (
                <option key={head.id} value={head.id}>
                  {head.fullName} {head.username ? `(@${head.username})` : ''}
                </option>
              ))}
            </select>
            {errors.headId ? <span className="field-error">{errors.headId.message}</span> : null}
          </div>

          <div className="field field-full stack gap-2">
            <label className="checkbox-field" htmlFor="dept-active">
              <input id="dept-active" type="checkbox" {...register('isActive')} />
              <span>Department is active</span>
            </label>
          </div>
        </div>
      </form>
    </Modal>
  );
}
