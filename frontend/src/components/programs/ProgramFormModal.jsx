import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';

import Modal from '../common/Modal';
import LoadingSpinner from '../common/LoadingSpinner';
import programService from '../../services/programService';

const DEGREE_TYPES = ['bachelor', 'master', 'phd', 'diploma', 'certificate'];
const SERVER_FIELDS = ['departmentId', 'code', 'name', 'degreeType', 'durationYears', 'description', 'isActive'];

const schema = z.object({
  departmentId: z.string().min(1, 'Select a department'),
  code: z
    .string()
    .trim()
    .min(2, 'Code must be 2-20 characters')
    .max(20, 'Code must be 2-20 characters')
    .regex(/^[A-Za-z0-9._-]+$/, 'Use letters, numbers, dot, underscore, or hyphen'),
  name: z.string().trim().min(2, 'Name must be 2-150 characters').max(150, 'Name must be 2-150 characters'),
  degreeType: z.enum(DEGREE_TYPES, { errorMap: () => ({ message: 'Select degree type' }) }),
  durationYears: z.number().int().min(1).max(10),
  description: z.string().trim().max(2000, 'Description too long').optional().or(z.literal('')),
  isActive: z.boolean(),
});

const degreeLabel = (type) => {
  const map = { bachelor: 'Bachelor', master: 'Master', phd: 'PhD', diploma: 'Diploma', certificate: 'Certificate' };
  return map[type] || type;
};

export default function ProgramFormModal({ mode, program, departments = [], onClose, onSaved }) {
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
            departmentId: '',
            code: '',
            name: '',
            degreeType: 'bachelor',
            durationYears: 4,
            description: '',
            isActive: true,
          }
        : {
            departmentId: program.department ? String(program.department.id) : '',
            code: program.code || '',
            name: program.name || '',
            degreeType: program.degreeType || 'bachelor',
            durationYears: program.durationYears || 4,
            description: program.description || '',
            isActive: Boolean(program.isActive),
          },
  });

  const onSubmit = async (values) => {
    setServerError(null);

    const payload = {
      departmentId: Number(values.departmentId),
      code: values.code.trim().toUpperCase(),
      name: values.name.trim(),
      degreeType: values.degreeType,
      durationYears: Number(values.durationYears),
      description: values.description ? values.description.trim() : null,
      isActive: values.isActive,
    };

    try {
      if (mode === 'create') {
        const response = await programService.create(payload);
        onSaved(`Program "${response.data.program.code}" created.`);
      } else {
        const response = await programService.update(program.id, payload);
        onSaved(`Program "${response.data.program.code}" updated.`);
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
        setServerError(error.message || 'Could not save program.');
      }
    }
  };

  const busy = isSubmitting;

  return (
    <Modal
      title={mode === 'create' ? 'New program' : 'Edit program'}
      subtitle={mode === 'create' ? 'Add a degree program.' : `${program.code} — ${program.name}`}
      onClose={busy ? () => {} : onClose}
      footer={
        <>
          <button type="button" className="btn btn-ghost" onClick={onClose} disabled={busy}>
            Cancel
          </button>
          <button type="submit" form="prog-form" className="btn btn-primary" disabled={busy}>
            {busy ? <LoadingSpinner inline /> : null}
            {mode === 'create' ? 'Create program' : 'Save changes'}
          </button>
        </>
      }
    >
      <form id="prog-form" className="stack gap-4" onSubmit={handleSubmit(onSubmit)} noValidate>
        {serverError ? (
          <div className="notice notice-danger" role="alert">
            {serverError}
          </div>
        ) : null}

        <div className="form-grid">
          <div className="field">
            <label className="field-label" htmlFor="prog-dept">
              Department
            </label>
            <select
              id="prog-dept"
              className="input"
              aria-invalid={errors.departmentId ? 'true' : 'false'}
              {...register('departmentId')}
            >
              <option value="">Select department</option>
              {departments.map((dept) => (
                <option key={dept.id} value={dept.id}>
                  {dept.name} ({dept.code})
                </option>
              ))}
            </select>
            {errors.departmentId ? <span className="field-error">{errors.departmentId.message}</span> : null}
          </div>

          <div className="field">
            <label className="field-label" htmlFor="prog-code">
              Code
            </label>
            <input
              id="prog-code"
              className="input"
              type="text"
              autoComplete="off"
              aria-invalid={errors.code ? 'true' : 'false'}
              {...register('code')}
            />
            {errors.code ? <span className="field-error">{errors.code.message}</span> : null}
          </div>

          <div className="field field-full">
            <label className="field-label" htmlFor="prog-name">
              Name
            </label>
            <input
              id="prog-name"
              className="input"
              type="text"
              autoComplete="off"
              aria-invalid={errors.name ? 'true' : 'false'}
              {...register('name')}
            />
            {errors.name ? <span className="field-error">{errors.name.message}</span> : null}
          </div>

          <div className="field">
            <label className="field-label" htmlFor="prog-degree">
              Degree type
            </label>
            <select
              id="prog-degree"
              className="input"
              aria-invalid={errors.degreeType ? 'true' : 'false'}
              {...register('degreeType')}
            >
              {DEGREE_TYPES.map((type) => (
                <option key={type} value={type}>
                  {degreeLabel(type)}
                </option>
              ))}
            </select>
            {errors.degreeType ? <span className="field-error">{errors.degreeType.message}</span> : null}
          </div>

          <div className="field">
            <label className="field-label" htmlFor="prog-duration">
              Duration (years)
            </label>
            <input
              id="prog-duration"
              className="input"
              type="number"
              min="1"
              max="10"
              step="1"
              aria-invalid={errors.durationYears ? 'true' : 'false'}
              {...register('durationYears', { valueAsNumber: true })}
            />
            {errors.durationYears ? <span className="field-error">{errors.durationYears.message}</span> : null}
          </div>

          <div className="field field-full">
            <label className="field-label" htmlFor="prog-description">
              Description
            </label>
            <textarea
              id="prog-description"
              className="input"
              rows={3}
              aria-invalid={errors.description ? 'true' : 'false'}
              {...register('description')}
            />
            {errors.description ? <span className="field-error">{errors.description.message}</span> : null}
          </div>

          <div className="field field-full stack gap-2">
            <label className="checkbox-field" htmlFor="prog-active">
              <input id="prog-active" type="checkbox" {...register('isActive')} />
              <span>Program is active</span>
            </label>
          </div>
        </div>
      </form>
    </Modal>
  );
}
